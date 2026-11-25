"use client";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

export default function GuestEntry({ onJoined, onClose }: { onJoined: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function join(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: name }), signal: AbortSignal.timeout(15000) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not join. Try again.");
      await onJoined();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not join. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop guest-backdrop" onClick={() => !busy && onClose()}><section className="modal guest-entry" role="dialog" aria-modal="true" aria-labelledby="guest-title" onClick={event => event.stopPropagation()} onKeyDown={event => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const nodes = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <button className="modal-close icon-button" aria-label="Close nickname form" onClick={onClose} disabled={busy}><X size={23} /></button>
    <h2 id="guest-title">PICK A NAME</h2>
    <form onSubmit={join}><label htmlFor="entry-nickname">Nickname</label><input id="entry-nickname" autoFocus autoComplete="nickname" maxLength={20} value={name} onChange={event => setName(event.target.value)} disabled={busy} /><p>This browser remembers you. No account needed.</p>{error && <p className="chat-error" role="alert">{error}</p>}<button className="solid-button" disabled={busy || name.trim().length < 2}>{busy ? "Joining…" : "Enter"}</button></form>
  </section></div>;
}
