"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AudioLines, BookOpen, Check, ChevronDown, Copy, Download, Headphones, HelpCircle, Keyboard, Languages, LoaderCircle, Mic, Play, Plus, Radio, RotateCcw, Settings2, ShieldCheck, Sparkles, Square, Trash2, Volume2, Waves, X, Zap, MessageSquare, Smile, WandSparkles, Bookmark, CheckCircle2 } from "lucide-react";
import { consumeEvents, partialResult, validResult } from "../lib/assist.mjs";
import { demoAnswer, samples, type Mode, type Answer } from "../lib/demo";

type Turn = { id: string; text: string; time: string; source: "live" | "typed" | "demo"; sample?: number; answer?: Answer; mode?: Mode; busy?: boolean; error?: string; duration?: number; saved?: boolean; speaker?: string; ordinal?: number };
type Config = { configured: boolean; provider: string };
type Tab = "desk" | "notes" | "audio";
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
const modes: { id: Mode; title: string; subtitle: string; icon: typeof Sparkles }[] = [
  { id: "natural", title: "Keep it natural", subtitle: "Casual. Confident. You.", icon: MessageSquare },
  { id: "fluent", title: "Show off", subtitle: "Unexpectedly fluent.", icon: Sparkles },
  { id: "funny", title: "Get a little weird", subtitle: "Good German. Odd ideas.", icon: Smile },
  { id: "gibberish", title: "Absolute Quatsch", subtitle: "German-ish nonsense.", icon: WandSparkles },
];
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const uid = () => crypto.randomUUID();

export default function Desk() {
  const [tab, setTab] = useState<Tab>("desk"); const [mode, setMode] = useState<Mode>("natural");
  const [turns, setTurns] = useState<Turn[]>([]); const turnsRef = useRef<Turn[]>([]);
  const [selected, setSelected] = useState<string | null>(null); const [partial, setPartial] = useState("");
  const [config, setConfig] = useState<Config | null>(null); const [settings, setSettings] = useState(false); const [help, setHelp] = useState(false);
  const [listening, setListening] = useState(false); const [connecting, setConnecting] = useState(false); const [demoRunning, setDemoRunning] = useState(false);
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
  useEffect(() => { fetch("/api/config", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(); const value = await r.json() as Config; if (typeof value.configured !== "boolean") throw new Error(); setConfig(value); }).catch(() => setNotice("Could not check the AI connection. Reload to try again.")); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns.length, partial]);
  useEffect(() => { if (!listening) return; const start = Date.now(); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [listening]);
  useEffect(() => () => { liveRef.current = false; sessionGeneration.current++; requestRef.current?.abort(); demoTimers.current.forEach(clearTimeout); recognitionRef.current?.abort(); streamRef.current?.getTracks().forEach(t => t.stop()); socketRef.current?.close(); void contextRef.current?.close(); cancelAnimationFrame(meterRef.current); if (referenceRef.current) URL.revokeObjectURL(referenceRef.current); }, []);
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
  function clearSession() { stopDemo(); stopCapture(false); requestRef.current?.abort(); updateTurns(() => []); setSelected(null); setPartial(""); setElapsed(0); setNotice("Session cleared. Nothing is stored by this app after you leave or reload."); }
  function submitTyped(e: FormEvent) { e.preventDefault(); if (!input.trim()) return; addFinal(input, "typed"); setInput(""); setTyped(false); }
  const active = turns.find(t => t.id === selected) || turns.at(-1); const chosenMode = modes.find(m => m.id === mode)!;
  const modeSelect = (next: Mode) => { setMode(next); modeRef.current = next; setPronounce(false); if (active) void analyze(active, next); };
  function exportNotes() {
    const text = turns.map(t => `[${t.time}] ${t.source === "demo" ? "EXAMPLE" : "GERMAN"}: ${t.text}\n${t.answer?.translation ? "ENGLISH: " + t.answer.translation : ""}\n${t.answer?.german ? "SUGGESTED REPLY (" + t.mode + "): " + t.answer.german + "\nMEANING: " + t.answer.english : ""}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "leute-session.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyReply() { if (!active?.answer?.german) return; try { await navigator.clipboard.writeText(active.answer.german); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNotice("Clipboard unavailable. Select the reply text to copy it."); } }
  function speakReply() { if (!active?.answer?.german || !("speechSynthesis" in window)) { setNotice("Speech playback is unavailable in this browser."); return; } if (listening) { setNotice("Stop listening before playback to keep the voice out of your transcript."); return; } speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(active.answer.german); speech.lang = "de-DE"; speech.rate = .85; speechSynthesis.speak(speech); }
  async function testMicrophone() { if (testing) { stopCapture(false); return; } stopCapture(false); setTesting(true); try { await attachMicrophone(); } catch (e) { stopCapture(false); setNotice(e instanceof Error ? e.message : "Microphone unavailable."); } }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="LEUTE home">LEUTE<span>!</span><i /></a>
      <p className="brand-caption">German, in the moment.</p>
      <div className="nav-label">YOUR WORKSPACE</div>
      <nav aria-label="Workspace">
        <button className={tab === "desk" ? "nav-item selected" : "nav-item"} onClick={() => setTab("desk")}><Radio size={19} />Live desk<span className="nav-badge">DE</span></button>
        <button className={tab === "notes" ? "nav-item selected" : "nav-item"} onClick={() => setTab("notes")}><BookOpen size={19} />Session notes{turns.length > 0 && <span className="count">{turns.length}</span>}</button>
        <button className={tab === "audio" ? "nav-item selected" : "nav-item"} onClick={() => setTab("audio")}><Headphones size={19} />Audio lab</button>
      </nav>
      <div className="sidebar-tip"><div className="tip-icon"><Languages size={22} /></div><strong>A little language.<br />A lot of personality.</strong><p>Catch what’s said.<br />Decide what comes next.</p><span>DU SCHAFFST DAS.</span></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setSettings(true)}><Settings2 size={18} />Settings</button><button className="nav-item" onClick={() => setHelp(true)}><HelpCircle size={18} />How it works</button><div className="made-mark"><span className="tiny-logo">L!</span><span>Your German sidekick<small>Made for the moment.</small></span></div></div>
    </aside>
    <main className="main-workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{tab === "desk" ? "Live desk" : tab === "notes" ? "Session notes" : "Audio lab"}</strong></div><div className="topbar-right"><span className="language-pair"><span className="german-flag" />Deutsch <span className="language-divider">/</span> English</span><button className="icon-button" aria-label="Open settings" onClick={() => setSettings(true)}><Settings2 size={18} /></button></div></header>
      <div className="workspace-body">
        <section className="page-heading"><div><div className="eyebrow"><span />YOUR GERMAN SIDEKICK</div><h1>{tab === "desk" ? <>Keep up. <span>Speak up.</span></> : tab === "notes" ? <>A few words <span>to keep.</span></> : <>Find your <span>frequency.</span></>}</h1><p>{tab === "desk" ? "Live meaning. A reply for every mood. You’ve got this." : tab === "notes" ? "Your conversation, all in one place. Here until you clear it or close the page." : "Check your microphone and get your listening setup ready."}</p></div><button className="button secondary new-session" onClick={clearSession}><Plus size={17} />New session</button></section>
        {tab === "desk" && <>
          <div className="session-strip"><div className="session-status"><span className={listening ? "status-dot on" : "status-dot"} />{listening ? "Listening live" : connecting ? "Connecting…" : demoRunning ? "Playing an example" : "Ready when you are"}{listening && <span className="elapsed">{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</span>}</div><div className="strip-right"><span><ShieldCheck size={14} />Session stays in this tab</span><button onClick={runDemo} disabled={demoRunning}><Play size={13} />Try an example</button></div></div>
          <div className="desk-grid">
            <section className="transcript-panel panel"><div className="panel-header"><div><span className="section-icon"><AudioLines size={19} /></span><h2>The conversation</h2></div><span className="small-tag">DE <span>/</span> EN</span></div>
              <div className="transcript-scroll" ref={scrollRef} role="log" aria-label="Conversation transcript" aria-live="polite">
                {!turns.length && !partial && <div className="empty-conversation"><div className="empty-art" aria-hidden="true"><div className="art-caption">HALLO, WELT.</div><div className="bubble german-bubble">Na, alles klar?<span className="bubble-tail" /></div><div className="bubble english-bubble">Getting there.<span className="mini-spark">✳</span></div><div className="art-wave">{[10, 19, 12, 29, 40, 22, 14, 32, 18, 11, 25, 14].map((v, i) => <i key={i} style={{ height: v }} />)}</div></div><h3>Let’s catch the conversation.</h3><p>Start listening to see German captions<br />and the English meaning, side by side.</p><button className="text-button" onClick={runDemo}>Take it for a test drive <Play size={13} /></button></div>}
                {turns.map(t => <button key={t.id} className={`transcript-turn ${active?.id === t.id ? "active" : ""}`} onClick={() => { setSelected(t.id); if (t.mode) { setMode(t.mode); modeRef.current = t.mode; } if (!t.answer && !t.busy) void analyze(t); }}><div className="turn-meta"><span>{t.source === "demo" ? "EXAMPLE" : t.source === "typed" ? "TYPED" : t.speaker ? `SPEAKER ${t.speaker}` : "HEARD IN GERMAN"}</span><time>{t.time}</time>{t.saved && <Bookmark size={12} />}</div><p lang="de">{t.text}</p><div className="turn-translation">{t.answer?.translation || (t.busy ? "Finding the meaning…" : "Select to translate")}</div></button>)}
                {partial && <div className="transcript-turn partial"><div className="turn-meta">{demoRunning ? "EXAMPLE • SIMULATED CAPTIONS" : "HEARING NOW"}<span className="typing-dots">•••</span></div><p lang="de">{partial}<span className="text-cursor" /></p></div>}
              </div>
              <div className="capture-controls"><div className="microphone-status"><div className={`mini-meter ${demoRunning ? "demo-meter" : ""}`}>{Array.from({ length: 15 }, (_, i) => <i key={i} style={{ height: 5 + (i % 5) * 3, background: level > i / 15 ? "var(--orange)" : undefined }} />)}</div><span>{listening ? "Microphone is on" : connecting ? "Requesting microphone" : "Microphone is off"}</span><button className="icon-button" onClick={() => setSettings(true)} aria-label="Microphone settings"><ChevronDown size={15} /></button></div><div className="capture-actions"><button className={`button primary ${listening || connecting ? "recording" : ""}`} onClick={startSession}>{connecting ? <LoaderCircle className="spin" size={18} /> : listening || demoRunning ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}{listening || connecting || demoRunning ? "Stop listening" : "Start listening"}</button><button className="button keyboard-button" onClick={() => setTyped(!typed)} aria-expanded={typed} aria-label="Type German instead"><Keyboard size={20} /></button></div>{typed && <form className="type-form" onSubmit={submitTyped}><label htmlFor="german-input">Type or paste what was said</label><textarea id="german-input" autoFocus maxLength={2500} value={input} onChange={e => setInput(e.target.value)} placeholder="Was habt ihr am Wochenende gemacht?" /><button className="button secondary" disabled={!input.trim()}>Translate & reply</button></form>}<p className="capture-note">Listen with everyone’s knowledge and permission.<br />Audio is processed by your selected speech provider.</p></div>
            </section>
            <div className="reply-column"><section className="modes-panel"><div className="section-title"><h2>Choose your energy</h2><span>YOUR REPLY, YOUR RULES</span></div><div className="mode-grid" role="group" aria-label="Reply mode">{modes.map(m => <button key={m.id} className={`mode-card mode-${m.id} ${mode === m.id ? "chosen" : ""}`} onClick={() => modeSelect(m.id)} aria-pressed={mode === m.id}><div className="mode-card-top"><m.icon size={19} /><span className="radio-circle">{mode === m.id && <Check size={10} strokeWidth={3} />}</span></div><strong>{m.title}</strong><span>{m.subtitle}</span></button>)}</div></section>
              <section className={`reply-card mode-accent-${mode}`} aria-live="polite" aria-busy={active?.busy || false}><div className="reply-card-header"><span><Sparkles size={15} />YOUR NEXT WORDS</span><span className="reply-mode-tag">{chosenMode.title}</span></div>{active?.source === "demo" && <span className="example-label">SCRIPTED EXAMPLE</span>}
                {active?.error ? <div className="reply-error"><HelpCircle size={26} /><h3>One connection to make.</h3><p>{active.error}</p><button className="button dark-button" onClick={() => config?.configured ? void analyze(active) : setSettings(true)}>{config?.configured ? "Try again" : "Connection settings"}</button></div> : active?.answer?.german ? <><p className="german-reply" lang="de">{active.answer.german}</p><div className="meaning-label">IN OTHER WORDS</div><p className="english-reply">{active.answer.english || "Translating the reply…"}</p>{active.answer.note && <p className="answer-note">{active.answer.note}</p>}{pronounce && <div className="pronunciation"><span>SAY IT LIKE THIS · APPROXIMATE</span><p>{active.answer.pronunciation}</p></div>}</> : <div className="reply-empty"><div className="sparkle-art"><Sparkles size={35} strokeWidth={1.3} /></div><h3>{active?.busy ? "Finding your words…" : "The right words.\nYour kind of delivery."}</h3><p>{active?.busy ? "Translation and a reply will appear here." : "Pick a mode. We’ll help with the rest."}</p></div>}
                <div className="reply-actions"><button onClick={copyReply} disabled={!active?.answer?.german}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button><button onClick={speakReply} disabled={!active?.answer?.german} aria-label="Hear the German reply"><Volume2 size={17} /></button><button onClick={() => setPronounce(!pronounce)} disabled={!active?.answer?.pronunciation} aria-pressed={pronounce} aria-label="Show pronunciation"><span className="phonetic-icon">Aa</span></button><button className="regenerate" aria-label="Regenerate reply" disabled={!active || active.busy} onClick={() => active && void analyze(active)}><RotateCcw size={16} /></button></div>
              </section><div className="reply-footnote"><Zap size={14} /><span>{active?.duration ? `${(active.duration / 1000).toFixed(1)}s to complete this reply` : "Built for quick comebacks. Timing depends on audio and network."}</span></div>
            </div>
          </div>
          <div className="bottom-banner"><div className="banner-mark">ß<span>!</span></div><div><strong>Same conversation. Four different personalities.</strong><p>Switch modes whenever the mood changes. The meaning stays true.</p></div><span className="banner-sticker">ALLES KLAR.</span></div>
        </>}
        {tab === "notes" && <section className="panel notes-panel"><div className="panel-header"><h2>Session notes <span className="count">{turns.length}</span></h2><button className="button secondary" onClick={exportNotes} disabled={!turns.length}><Download size={16} />Export text</button></div>{!turns.length ? <div className="simple-empty"><BookOpen size={36} /><h3>A blank page, for now.</h3><p>Your transcript and replies will show up here.</p><button className="button primary" onClick={() => setTab("desk")}>Open live desk</button></div> : <div className="notes-list">{turns.map(t => <article key={t.id}><div className="turn-meta">{t.source === "demo" ? "SCRIPTED EXAMPLE" : t.time}<button className="icon-button" aria-label={t.saved ? "Remove bookmark" : "Bookmark utterance"} onClick={() => patchTurn(t.id, { saved: !t.saved })}><Bookmark size={16} fill={t.saved ? "currentColor" : "none"} /></button></div><h3 lang="de">{t.text}</h3><p>{t.answer?.translation || "Not translated yet."}</p>{t.answer?.german && <div className="note-answer"><span>YOUR REPLY · {t.mode}</span><p lang="de">{t.answer.german}</p><small>{t.answer.english}</small></div>}</article>)}</div>}<div className="notes-footer"><ShieldCheck size={15} />Notes are kept in this tab’s memory. Export anything you want to keep.<button onClick={clearSession} disabled={!turns.length}><Trash2 size={14} />Clear session</button></div></section>}
        {tab === "audio" && <div className="audio-grid"><section className="panel audio-card"><span className="audio-card-icon"><Mic size={25} /></span><h2>Give your mic a moment.</h2><p>Test the actual Chromebook at the distance you’ll use it. This meter measures volume, not recognition accuracy.</p><div className="large-meter">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ background: level > i / 32 ? "var(--orange)" : undefined }} />)}</div><div className="meter-label"><span>QUIET</span><span>LOUD</span></div><button className="button primary" onClick={testMicrophone}>{testing ? <Square size={16} /> : <Mic size={17} />}{testing ? "Stop mic test" : "Test microphone"}</button><p className="subtle-note">Mic test stays on your device. No transcription is started.</p></section><section className="panel audio-card"><span className="audio-card-icon violet"><Waves size={25} /></span><div className="card-title-with-tag"><h2>One voice in the room.</h2><span className="small-tag">EXPERIMENTAL</span></div><p>A voice sample can support a future speaker filter. Reference preview is available now; voice isolation is not connected.</p><label className="upload-zone"><Plus size={22} /><strong>{reference ? "Choose a different reference" : "Preview a voice reference"}</strong><span>Audio file · up to 10 MB · stays in this tab</span><input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setNotice("Please choose an audio reference under 10 MB."); return; } if (referenceRef.current) URL.revokeObjectURL(referenceRef.current); const url = URL.createObjectURL(file); referenceRef.current = url; setReference({ name: file.name, url }); e.target.value = ""; }} /></label>{reference && <div className="reference-preview"><div><span>{reference.name}</span><button className="icon-button" aria-label="Remove voice reference" onClick={() => { URL.revokeObjectURL(reference.url); referenceRef.current = null; setReference(null); }}><X size={15} /></button></div><audio controls src={reference.url} /><small>Preview only. This sample does not filter live audio.</small></div>}<div className="info-callout"><ShieldCheck size={17} /><span>Use a reference willingly provided by its speaker. Nothing is uploaded from this panel.</span></div></section></div>}
        <footer className="workspace-footer"><span>LEUTE! <span className="footer-separator">/</span> Find your words.</span><button onClick={() => setSettings(true)}><span className={`connection-indicator ${config?.configured ? "connected" : ""}`} />{config === null ? "Checking connection" : config.configured ? "Meta connected" : "AI connection needed"}</button></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><HelpCircle size={18} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
    {(settings || help) && <div className="modal-backdrop" onClick={() => { setSettings(false); setHelp(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== "Tab") return; const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'); const first = nodes[0]; const last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setSettings(false); setHelp(false); }} autoFocus><X size={21} /></button><span className="eyebrow">A LITTLE FINE-TUNING</span><h2 id="dialog-title">{settings ? "Make yourself heard." : "Your next words start here."}</h2>{settings ? <>
      <div className={`connection-card ${config?.configured ? "is-connected" : ""}`}><CheckCircle2 size={22} /><div><strong>{config?.configured ? "Meta API is configured" : "Connect Meta to go live"}</strong><p>{config?.configured ? "Live transcription, translation, and replies are ready to test." : "Add MODEL_API_KEY as a server secret to use your dev.meta.ai credits. Never put it in browser code or GitHub."}</p>{!config?.configured && <a href="https://dev.meta.ai/" target="_blank" rel="noreferrer">Open Meta dashboard</a>}</div></div>
      <div className="settings-field"><label htmlFor="speech-engine">Speech engine</label><select id="speech-engine" value={engine} disabled={listening || connecting} onChange={e => setEngine(e.target.value as "meta" | "browser")}><option value="meta">Meta streaming · API key required</option><option value="browser">Chrome captions · transcript only without AI key</option></select><p>Chrome speech recognition may send audio to the browser’s speech service. Availability depends on browser and school settings.</p></div>
      <label className="toggle-row"><div><strong>Reduce background noise</strong><span>Browser microphone processing. Does not isolate one speaker.</span></div><input type="checkbox" checked={noise} disabled={listening || testing || connecting} onChange={e => setNoise(e.target.checked)} /></label>
      <label className="toggle-row"><div><strong>Label different speakers</strong><span>Meta only. Session labels, not verified identities. May add delay.</span></div><input type="checkbox" checked={speakers} disabled={listening || connecting || engine !== "meta"} onChange={e => setSpeakers(e.target.checked)} /></label>
      <label className="toggle-row"><div><strong>Translate and reply automatically</strong><span>Process the latest utterance. Click older captions to revisit.</span></div><input type="checkbox" checked={autoReply} onChange={e => setAutoReply(e.target.checked)} /></label>
      <p className="settings-footnote">Audio streams to the selected speech service. Text goes to Meta for translation and replies. The app saves no audio or transcript history to its server. Provider retention policies still apply. Sessions stop after 20 minutes.</p><button className="button primary full-width" onClick={() => setSettings(false)}>All set</button>
    </> : <><div className="how-step"><span><Mic size={21} /></span><div><h3>Catch the conversation.</h3><p>Start listening with the speaker’s permission, or type a phrase. German captions appear as speech arrives.</p></div></div><div className="how-step"><span><Languages size={21} /></span><div><h3>Get the meaning.</h3><p>English translation appears under the completed utterance. Noisy or overlapping speech can be misheard.</p></div></div><div className="how-step"><span><Sparkles size={21} /></span><div><h3>Choose your energy.</h3><p>Pick a natural, fluent, funny, or deliberately nonsensical reply. The original translation stays accurate in every mode.</p></div></div><div className="info-callout"><ShieldCheck size={18} /><span>This is a suggestion tool. You decide what to say. Example sessions use prewritten content; voice isolation is not active.</span></div><button className="button primary full-width" onClick={() => { setHelp(false); runDemo(); }}>Try an example</button></>}</section></div>}
  </div>;
}
