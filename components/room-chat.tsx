"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, LoaderCircle, MessageCircle, X } from "lucide-react";

type Member = { id: string; nickname: string };
type Message = { id: number; clientId: string; memberId: string; nickname: string; text: string; createdAt: number };
type Session = { room: { code: string; expiresAt: number }; me: Member; members: Member[]; messages: Message[]; cursor: number };
type Status = { signedIn: boolean; available: boolean };
class ChatError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
const ROOM_KEY = "fraubot-chat-room";
const NAME_KEY = "fraubot-chat-nickname";
const prettyCode = (code: string) => code.slice(0, 5) + "-" + code.slice(5);
const cleanCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");
const time = (value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

async function api<T = unknown>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/chat" + path, {
    method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
  if (!response.ok) throw new ChatError(data.error || "Chat couldn’t connect. Try again.", response.status, data.code);
  return data as T;
}

export default function RoomChat() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connected" | "retrying">("connected");
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const openRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const cursor = useRef(0);
  const sending = useRef(false);
  const pending = useRef<{ clientId: string; text: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function forgetRoom() {
    sessionRef.current = null; setSession(null); messagesRef.current = []; setMessages([]);
    cursor.current = 0; setUnread(0); setDraft(""); pending.current = null;
    try { localStorage.removeItem(ROOM_KEY); } catch { /* In-memory chat still works. */ }
  }
  function enterRoom(data: Session) {
    sessionRef.current = data; setSession(data); messagesRef.current = data.messages; setMessages(data.messages);
    cursor.current = data.cursor; setUnread(0); setError(""); setConnection("connected"); stickToBottom.current = true;
    try { localStorage.setItem(ROOM_KEY, data.room.code); localStorage.setItem(NAME_KEY, data.me.nickname); } catch { /* Optional device convenience. */ }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function restore() {
      try {
        let saved = "";
        try { setName(localStorage.getItem(NAME_KEY) || ""); saved = localStorage.getItem(ROOM_KEY) || ""; } catch { /* Storage may be disabled. */ }
        const config: Status = await api("/status", undefined, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(config);
        if (saved && config.signedIn && config.available) {
          const data: Session = await api("/rooms/" + cleanCode(saved), undefined, controller.signal);
          if (!controller.signal.aborted) enterRoom(data);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ChatError && [403, 404].includes(e.status)) forgetRoom();
        else setError(e instanceof Error ? e.message : "Chat couldn’t connect. Try refreshing.");
      } finally { if (!controller.signal.aborted) setRestoring(false); }
    }
    void restore();
    return () => { controller.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    setUnread(0); stickToBottom.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.focus();
    return () => { document.body.style.overflow = overflow; (previous?.isConnected ? previous : trigger.current)?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!session) return;
    const roomCode = session.room.code;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    async function poll() {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const data: Session = await api(`/rooms/${roomCode}?after=${cursor.current}`, undefined, controller.signal);
        if (controller.signal.aborted || sessionRef.current?.room.code !== roomCode) return;
        const known = new Set(messagesRef.current.map(m => m.id));
        const fresh = data.messages.filter(m => !known.has(m.id));
        if (fresh.length) {
          const next = [...messagesRef.current, ...fresh].sort((a, b) => a.id - b.id).slice(-100);
          messagesRef.current = next; setMessages(next);
          if (!openRef.current) setUnread(n => n + fresh.filter(m => m.memberId !== data.me.id).length);
        }
        cursor.current = data.cursor;
        setSession(current => current?.room.code === roomCode ? { ...current, members: data.members } : current);
        setConnection("connected");
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ChatError && [401, 403, 404].includes(e.status)) {
          forgetRoom(); setError(e.message);
          if (e.status === 401) setStatus(s => s ? { ...s, signedIn: false } : s);
          return;
        }
        setConnection("retrying");
      } finally {
        fetching = false;
        if (!controller.signal.aborted) timer = setTimeout(() => { if (document.visibilityState !== "hidden") void poll(); else timer = setTimeout(poll, 10000); }, openRef.current ? 2000 : 5000);
      }
    }
    const wake = () => { clearTimeout(timer); if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [session?.room.code, open]);

  useEffect(() => {
    if (open && stickToBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);

  async function join(create: boolean) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { enterRoom(await api(create ? "/rooms" : "/join", { nickname: name, ...(!create ? { code: cleanCode(code) } : {}) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t join. Try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (!session || !draft.trim() || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    const text = draft.trim();
    if (!pending.current || pending.current.text !== text) pending.current = { text, clientId: crypto.randomUUID() };
    const roomCode = session.room.code;
    try {
      const data: { message: Message } = await api(`/rooms/${roomCode}/messages`, pending.current);
      if (sessionRef.current?.room.code !== roomCode) return;
      const next = [...messagesRef.current.filter(m => m.id !== data.message.id), data.message].sort((a, b) => a.id - b.id).slice(-100);
      messagesRef.current = next; setMessages(next); setDraft(""); pending.current = null; stickToBottom.current = true;
      // The polling cursor advances only on reads, so intervening messages are never skipped.
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send. Try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function leave() {
    if (!session || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { await api(`/rooms/${session.room.code}/leave`, {}); forgetRoom(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t leave. Try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function copyCode() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(prettyCode(session.room.code)); setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError("Select the room code and copy it manually."); }
  }

  return <>
    <button ref={trigger} className={`utility-button chat-trigger ${open ? "selected" : ""}`} aria-label={unread ? `Chat, ${unread} unread messages` : "Chat"} title="Chat" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <MessageCircle size={18} /><span>Chat</span>{unread > 0 && <b className="chat-unread">{unread > 9 ? "9+" : unread}</b>}
    </button>
    {open && createPortal(<div className="chat-backdrop" onClick={() => setOpen(false)}>
      <section ref={panel} className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === "Escape") setOpen(false);
        if (e.key !== "Tab") return;
        const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])');
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) { e.preventDefault(); first?.focus(); }
      }}>
        <header className="chat-header"><div><span className="chat-eyebrow">fraubot</span><h2 id="chat-title">THE GROUP CHAT</h2></div><button className="icon-button chat-close" aria-label="Close chat" onClick={() => setOpen(false)}><X size={23} /></button></header>
        {restoring ? <div className="chat-loading" role="status"><LoaderCircle className="spin" size={24} />Opening chat…</div> : !status?.signedIn ? <div className="chat-setup"><span className="chat-doodle" aria-hidden="true">💬</span><h3>One shared brain cell.</h3><p>Sign in to make a room and message your friends.</p><a className="solid-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in to chat</a>{error && <p className="chat-error" role="alert">{error}</p>}</div> : !session ? <div className="chat-setup">
          <span className="chat-doodle" aria-hidden="true">💬</span><h3>One shared brain cell.</h3><p>Pick a nickname. Make a room or grab a friend’s code.</p>
          <form onSubmit={e => { e.preventDefault(); void join(false); }}>
            <label htmlFor="chat-nickname">Your nickname</label><input id="chat-nickname" autoComplete="nickname" maxLength={20} value={name} onChange={e => setName(e.target.value)} placeholder="KartoffelCEO" disabled={busy} />
            <button type="button" className="solid-button chat-create" disabled={busy || name.trim().length < 2 || !status.available} onClick={() => void join(true)}>{busy ? "One sec…" : "Make a room"}</button>
            <div className="chat-or"><span>or join one</span></div>
            <label htmlFor="chat-code">Room code</label><input id="chat-code" className="chat-code-input" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={14} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCDE-FG234" disabled={busy} />
            <button className="plain-button" disabled={busy || name.trim().length < 2 || cleanCode(code).length !== 10 || !status.available}>Join room</button>
          </form>
          {!status.available && <p className="chat-error" role="alert">Chat is getting ready. Try refreshing shortly.</p>}
          {error && <p className="chat-error" role="alert">{error}</p>}
          <p className="chat-fine-print">Up to 20 people. Rooms expire after 24 hours. Friends need access to this site, too.</p>
        </div> : <>
          <div className="chat-room-bar"><div><span>ROOM CODE</span><strong>{prettyCode(session.room.code)}</strong></div><button className="plain-button" aria-label={copied ? "Room code copied" : "Copy room code"} onClick={copyCode}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button><button className="text-button" disabled={busy} onClick={() => void leave()}>Leave</button></div>
          <div className="chat-members"><span>You: <b>{session.me.nickname}</b></span><details><summary>{session.members.length} {session.members.length === 1 ? "person" : "people"}</summary><p>{session.members.map(m => m.nickname).join(" · ")}</p></details></div>
          <div ref={log} className="chat-messages" role="log" aria-label="Room messages" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = log.current; if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {!messages.length ? <div className="chat-empty"><span aria-hidden="true">👀</span><h3>Suspiciously quiet.</h3><p>Share the code. Send the first message.</p></div> : messages.map(message => <article key={message.id} className={`chat-message ${message.memberId === session.me.id ? "mine" : ""}`}><div className="chat-message-meta"><b>{message.memberId === session.me.id ? "You" : message.nickname}</b><time dateTime={new Date(message.createdAt).toISOString()}>{time(message.createdAt)}</time></div><p>{message.text}</p></article>)}
          </div>
          <div className="chat-connection" role="status">{connection === "retrying" ? "Connection wobble. Reconnecting…" : "Messages update automatically."}<span>Room ends {new Date(session.room.expiresAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
          {error && <p className="chat-error chat-send-error" role="alert">{error}</p>}
          <form className="chat-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-message">Message</label><textarea id="chat-message" rows={2} maxLength={1000} placeholder="Say something questionable…" value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void sendMessage(); } }} /><div><span>{draft.length}/1,000 · Shift+Enter for a new line</span><button className="solid-button" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send"}</button></div></form>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
