"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, MessageCircle, X } from "lucide-react";
import DirectMessages, { useDirectMessages } from "./direct-messages";

type Member = { id: string; nickname: string };
type Message = { id: number; memberId: string; nickname: string; text: string; createdAt: number };
type Snapshot = { signedIn: boolean; me: Member | null; messages: Message[]; cursor: number };
class ChatError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path = "", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/chat/classroom" + path, {
    method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new ChatError("Chat could not connect. Refresh and try again.", response.status);
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new ChatError(data.error || "Chat could not connect. Try again.", response.status);
  return data as T;
}
const time = (value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function RoomChat({ guestAccess = false, onJoin }: { guestAccess?: boolean; onJoin?: () => void }) {
  const join = () => { setOpen(false); onJoin?.(); };
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"class" | "dm">("class");
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Member | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connected" | "retrying">("connected");
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);
  const viewRef = useRef(view); viewRef.current = view;
  const messagesRef = useRef<Message[]>([]);
  const cursor = useRef(0);
  const hasLoaded = useRef(false);
  const sending = useRef(false);
  const pending = useRef<{ clientId: string; text: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const dm = useDirectMessages(signedIn ? me : null, open && view === "dm");
  const totalUnread = unread + dm.unread;

  useEffect(() => { if (open && view === "class") setUnread(0); }, [open, view]);

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    stickToBottom.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.focus();
    return () => { document.body.style.overflow = overflow; (previous?.isConnected ? previous : trigger.current)?.focus(); };
  }, [open]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    async function poll() {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const data = await api<Snapshot>(`?after=${cursor.current}`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        const known = new Set(messagesRef.current.map(m => m.id));
        const fresh = data.messages.filter(m => !known.has(m.id));
        const cutoff = Date.now() - 86400000;
        const next = [...messagesRef.current, ...fresh].filter(m => m.createdAt > cutoff).sort((a, b) => a.id - b.id).slice(-100);
        messagesRef.current = next; setMessages(next);
        if (hasLoaded.current && !(openRef.current && viewRef.current === "class")) setUnread(n => n + fresh.filter(m => m.memberId !== data.me?.id).length);
        cursor.current = data.cursor; setSignedIn(data.signedIn); setMe(data.me);
        if (data.me) setName(current => current || data.me!.nickname);
        hasLoaded.current = true; setLoaded(true); setConnection("connected");
      } catch {
        if (!controller.signal.aborted) { setLoaded(true); setConnection("retrying"); }
      } finally {
        fetching = false;
        if (!controller.signal.aborted) timer = setTimeout(poll, document.visibilityState === "hidden" ? 15000 : openRef.current ? 2000 : 5000);
      }
    }
    const wake = () => { clearTimeout(timer); if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [open]);

  useEffect(() => {
    if (open && stickToBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open, view]);

  async function saveName(e: FormEvent) {
    e.preventDefault(); if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { const data = await api<{ me: Member }>("/profile", { nickname: name }); setMe(data.me); setName(data.me.nickname); setEditingName(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save your nickname."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function sendMessage(e?: FormEvent) {
    e?.preventDefault(); if (!me || !draft.trim() || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    const text = draft.trim();
    if (!pending.current || pending.current.text !== text) pending.current = { text, clientId: crypto.randomUUID() };
    try {
      const data = await api<{ message: Message }>("/messages", pending.current);
      const next = [...messagesRef.current.filter(m => m.id !== data.message.id), data.message].sort((a, b) => a.id - b.id).slice(-100);
      messagesRef.current = next; setMessages(next); setDraft(""); pending.current = null; stickToBottom.current = true;
      // Only reads advance the cursor, so a send never skips intervening messages.
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send. Try again."); }
    finally { sending.current = false; setBusy(false); }
  }

  return <>
    <button ref={trigger} className={`utility-button chat-trigger ${open ? "selected" : ""}`} aria-label={totalUnread ? `Chat, ${totalUnread} unread messages` : "Chat"} title="Chat" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <MessageCircle size={18} /><span>Chat</span>{totalUnread > 0 && <b className="chat-unread">{totalUnread > 9 ? "9+" : totalUnread}</b>}
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
        <header className="chat-header"><div><span className="chat-eyebrow">fraubot</span><h2 id="chat-title">CHAT</h2></div><button className="icon-button chat-close" aria-label="Close chat" onClick={() => setOpen(false)}><X size={23} /></button></header>
        <div className="chat-tabs" role="tablist" aria-label="Chat channels"><button id="class-tab" role="tab" aria-selected={view === "class"} aria-controls="class-panel" tabIndex={view === "class" ? 0 : -1} onClick={() => setView("class")} onKeyDown={e => { if (e.key === "ArrowRight") { setView("dm"); document.getElementById("dm-tab")?.focus(); } }}>Class{unread > 0 && <b className="dm-count">{unread}</b>}</button><button id="dm-tab" role="tab" aria-selected={view === "dm"} aria-controls="dm-panel" tabIndex={view === "dm" ? 0 : -1} onClick={() => setView("dm")} onKeyDown={e => { if (e.key === "ArrowLeft") { setView("class"); document.getElementById("class-tab")?.focus(); } }}>DMs{dm.unread > 0 && <b className="dm-count">{dm.unread}</b>}</button></div>
        {view === "class" && <p className="chat-channel-note">Public chat · Messages from the last 24 hours</p>}
        {loaded && signedIn && (!me || editingName) && <form className="chat-profile" onSubmit={saveName}><label htmlFor="chat-nickname">Nickname</label><div><input id="chat-nickname" autoComplete="nickname" maxLength={20} value={name} onChange={e => setName(e.target.value)} placeholder="Your nickname" disabled={busy} /><button className="solid-button" disabled={busy || name.trim().length < 2}>{busy ? "Saving…" : "Save"}</button>{me && <button type="button" className="text-button" onClick={() => { setName(me.nickname); setEditingName(false); }}>Cancel</button>}</div></form>}
        {loaded && signedIn && me && !editingName && <div className="chat-members"><span>Posting as <b>{me.nickname}</b></span><button className="text-button" onClick={() => setEditingName(true)}>Change</button></div>}
        {view === "class" ? <div id="class-panel" className="chat-channel-panel" role="tabpanel" aria-labelledby="class-tab"><div ref={log} className="chat-messages" role="log" aria-label="Class messages" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = log.current; if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {!loaded ? <div className="chat-loading" role="status"><LoaderCircle className="spin" size={24} />Loading messages…</div> : !messages.length ? <div className="chat-empty"><p>{connection === "retrying" ? "Messages could not load. Reconnecting…" : "No messages yet."}</p></div> : messages.map(message => <article key={message.id} className={`chat-message ${message.memberId === me?.id ? "mine" : ""}`}><div className="chat-message-meta">{me && message.memberId !== me.id ? <button className="chat-author" aria-label={`Message ${message.nickname}`} onClick={() => { dm.selectPeer({ id: message.memberId, nickname: message.nickname }); setView("dm"); }}>{message.nickname}</button> : <b>{message.memberId === me?.id ? "You" : message.nickname}</b>}<time dateTime={new Date(message.createdAt).toISOString()}>{time(message.createdAt)}</time></div><p>{message.text}</p></article>)}
        </div>
        <div className="chat-connection" role="status">{connection === "retrying" ? "Reconnecting…" : "Messages update automatically."}</div>
        {error && <p className="chat-error chat-send-error" role="alert">{error}</p>}
        {loaded && !signedIn ? <div className="chat-signin"><span>{guestAccess ? "Pick a nickname to post." : "Sign in to post."}</span>{guestAccess ? <button className="solid-button" onClick={join}>Enter</button> : <a className="solid-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>}</div> : <form className="chat-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-message">Message</label><textarea id="chat-message" rows={2} maxLength={1000} placeholder={me ? "Message the class…" : "Choose a nickname to post"} value={draft} disabled={busy || !me} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void sendMessage(); } }} /><div><span>{draft.length}/1,000 · Shift+Enter for a new line</span><button className="solid-button" disabled={busy || !me || !draft.trim()}>{busy ? "Sending…" : "Send"}</button></div></form>}</div> : <div id="dm-panel" className="chat-channel-panel" role="tabpanel" aria-labelledby="dm-tab"><DirectMessages state={dm} me={me} signedIn={signedIn} guestAccess={guestAccess} onJoin={join} /></div>}
      </section>
    </div>, document.body)}
  </>;
}
