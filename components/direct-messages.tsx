"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";

type Person = { id: string; nickname: string };
type Message = { id: number; memberId: string; nickname: string; text: string; createdAt: number };
type Conversation = Person & { preview: string; updatedAt: number; unread: number };
type Inbox = { me: Person; people: Person[]; conversations: Conversation[]; unread: number };
type Thread = { me: Person; peer: Person; messages: Message[]; cursor: number };
async function api<T>(path = "", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/chat/dm" + path, {
    method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Direct messages could not connect. Refresh and try again.");
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Direct messages could not connect. Try again.");
  return data as T;
}
const time = (value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function useDirectMessages(me: Person | null, visible: boolean) {
  const [people, setPeople] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState(0);
  const [peer, setPeer] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [threadLoaded, setThreadLoaded] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const peerRef = useRef(peer); peerRef.current = peer;
  const messagesRef = useRef<Message[]>([]);
  const cursor = useRef(0);
  const acknowledged = useRef(0);
  const sending = useRef(false);
  const pending = useRef<{ peerId: string; text: string; clientId: string } | null>(null);
  const refreshInbox = useRef<() => void>(() => {});

  function selectPeer(next: Person | null) {
    if (next?.id === peerRef.current?.id) return;
    peerRef.current = next; setPeer(next); messagesRef.current = []; setMessages([]);
    cursor.current = 0; acknowledged.current = 0; pending.current = null;
    setDraft(""); setError(""); setThreadLoaded(false); setRetrying(false);
  }

  useEffect(() => {
    setPeople([]); setConversations([]); setUnread(0); setLoaded(false); selectPeer(null);
    if (!me) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    async function poll() {
      if (fetching || controller.signal.aborted) return;
      clearTimeout(timer); fetching = true;
      try {
        const data = await api<Inbox>("", undefined, controller.signal);
        if (!controller.signal.aborted) { setPeople(data.people); setConversations(data.conversations); setUnread(data.unread); setLoaded(true); if (!peerRef.current) setRetrying(false); }
      } catch {
        if (!controller.signal.aborted) { setLoaded(true); if (!peerRef.current) setRetrying(true); }
      } finally {
        fetching = false;
        if (!controller.signal.aborted) timer = setTimeout(poll, document.visibilityState === "hidden" ? 15000 : 5000);
      }
    }
    refreshInbox.current = () => { void poll(); };
    const wake = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); refreshInbox.current = () => {}; document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [me?.id]);

  useEffect(() => {
    if (!me || !peer || !visible) return;
    const peerId = peer.id;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    async function poll() {
      if (fetching || controller.signal.aborted) return;
      clearTimeout(timer); fetching = true;
      try {
        const data = await api<Thread>(`/${peerId}?after=${cursor.current}`, undefined, controller.signal);
        if (controller.signal.aborted || peerRef.current?.id !== peerId) return;
        const known = new Set(messagesRef.current.map(m => m.id));
        const fresh = data.messages.filter(m => !known.has(m.id));
        const next = [...messagesRef.current, ...fresh].filter(m => m.createdAt > Date.now() - 86400000).sort((a, b) => a.id - b.id).slice(-100);
        messagesRef.current = next; setMessages(next); setPeer(data.peer);
        cursor.current = data.cursor; setThreadLoaded(true); setRetrying(false);
        if (visibleRef.current && document.visibilityState === "visible" && data.cursor > acknowledged.current) {
          await api(`/${peerId}/read`, { throughId: data.cursor }, controller.signal);
          if (controller.signal.aborted) return;
          acknowledged.current = data.cursor; refreshInbox.current();
        }
      } catch {
        if (!controller.signal.aborted && peerRef.current?.id === peerId) { setThreadLoaded(true); setRetrying(true); }
      } finally {
        fetching = false;
        if (!controller.signal.aborted) timer = setTimeout(poll, document.visibilityState === "hidden" ? 15000 : 2000);
      }
    }
    const wake = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [me?.id, peer?.id, visible]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (!me || !peer || !draft.trim() || sending.current) return;
    const peerId = peer.id; const text = draft.trim();
    sending.current = true; setBusy(true); setError("");
    if (!pending.current || pending.current.peerId !== peerId || pending.current.text !== text) pending.current = { peerId, text, clientId: crypto.randomUUID() };
    try {
      const data = await api<{ message: Message }>(`/${peerId}/messages`, { text, clientId: pending.current.clientId });
      if (peerRef.current?.id === peerId) {
        const next = [...messagesRef.current.filter(m => m.id !== data.message.id), data.message].sort((a, b) => a.id - b.id).slice(-100);
        messagesRef.current = next; setMessages(next); setDraft(""); pending.current = null;
      }
      refreshInbox.current();
    } catch (e) { if (peerRef.current?.id === peerId) setError(e instanceof Error ? e.message : "Could not send. Try again."); }
    finally { sending.current = false; setBusy(false); }
  }
  return { people, conversations, unread, peer, messages, search, setSearch, draft, setDraft, busy, loaded, threadLoaded, error, retrying, selectPeer, sendMessage };
}

type Props = { state: ReturnType<typeof useDirectMessages>; me: Person | null; signedIn: boolean; guestAccess?: boolean; onJoin?: () => void };
export default function DirectMessages({ state: dm, me, signedIn, guestAccess = false, onJoin }: Props) {
  const log = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useEffect(() => { stickToBottom.current = true; }, [dm.peer?.id]);
  useEffect(() => { if (stickToBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight; }, [dm.messages]);
  if (!signedIn) return <div className="dm-access"><p>{guestAccess ? "Pick a nickname to use private messages." : "Sign in to use private messages."}</p>{guestAccess ? <button className="solid-button" onClick={onJoin}>Enter</button> : <a className="solid-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>}</div>;
  if (!me) return <div className="dm-access"><p>Choose a nickname above to use direct messages.</p></div>;
  if (!dm.peer) {
    const query = dm.search.trim().toLocaleLowerCase();
    const conversations = dm.conversations.filter(p => p.nickname.toLocaleLowerCase().includes(query));
    const people = dm.people.filter(p => p.nickname.toLocaleLowerCase().includes(query));
    return <div className="dm-inbox">
      <label className="dm-search"><Search size={17} /><span className="sr-only">Search nicknames</span><input type="search" value={dm.search} onChange={e => dm.setSearch(e.target.value)} placeholder="Search nicknames" /></label>
      {!dm.loaded ? <div className="chat-loading" role="status"><LoaderCircle className="spin" size={23} />Loading messages…</div> : <>
        {conversations.length > 0 && <section className="dm-list" aria-label="Recent conversations"><h3>Recent messages</h3>{conversations.map(person => <button key={person.id} className="dm-person" onClick={() => dm.selectPeer(person)}><span><strong>{person.nickname}</strong><small>{person.preview}</small></span><span className="dm-person-meta"><time>{time(person.updatedAt)}</time>{person.unread > 0 && <b className="dm-count">{person.unread}</b>}</span></button>)}</section>}
        <section className="dm-list" aria-label="People"><h3>New message</h3>{people.map(person => <button key={person.id} className="dm-person" onClick={() => dm.selectPeer(person)}><strong>{person.nickname}</strong><span className="dm-person-action">Message</span></button>)}{!people.length && <p className="dm-empty">{query ? "No matching nicknames." : "Other people appear here after choosing a nickname."}</p>}</section>
        {dm.retrying && <p className="dm-empty" role="status">Could not load messages. Reconnecting…</p>}
      </>}
    </div>;
  }
  return <div className="dm-thread">
    <div className="dm-thread-heading"><button className="plain-button" disabled={dm.busy} onClick={() => dm.selectPeer(null)}>Back</button><div><h3>{dm.peer.nickname}</h3><p>Private conversation</p></div></div>
    <div ref={log} className="chat-messages" role="log" aria-label={`Direct messages with ${dm.peer.nickname}`} aria-live="polite" aria-relevant="additions" onScroll={() => { const el = log.current; if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {!dm.threadLoaded ? <div className="chat-loading" role="status"><LoaderCircle className="spin" size={23} />Loading messages…</div> : !dm.messages.length ? <div className="chat-empty"><p>{dm.retrying ? "Could not load messages. Reconnecting…" : "No messages yet."}</p></div> : dm.messages.map(message => <article key={message.id} className={`chat-message ${message.memberId === me.id ? "mine" : ""}`}><div className="chat-message-meta"><b>{message.memberId === me.id ? "You" : message.nickname}</b><time dateTime={new Date(message.createdAt).toISOString()}>{time(message.createdAt)}</time></div><p>{message.text}</p></article>)}
    </div>
    <div className="chat-connection" role="status">{dm.retrying ? "Reconnecting…" : "Messages from the last 24 hours."}</div>
    {dm.error && <p className="chat-error chat-send-error" role="alert">{dm.error}</p>}
    <form className="chat-compose" onSubmit={e => { stickToBottom.current = true; void dm.sendMessage(e); }}><label className="sr-only" htmlFor="dm-message">Direct message</label><textarea id="dm-message" rows={2} maxLength={1000} placeholder={`Message ${dm.peer.nickname}…`} value={dm.draft} disabled={dm.busy} onChange={e => dm.setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); stickToBottom.current = true; void dm.sendMessage(); } }} /><div><span>{dm.draft.length}/1,000 · Shift+Enter for a new line</span><button className="solid-button" disabled={dm.busy || !dm.draft.trim()}>{dm.busy ? "Sending…" : "Send DM"}</button></div></form>
  </div>;
}
