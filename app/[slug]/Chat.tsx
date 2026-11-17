"use client";
import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat({ slug }: { slug: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "¡Hola! ¿Para cuántas personas y cuándo? Ej: «una mesa para 4 el viernes en la noche»." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // The initial greeting is UI only; the API must start with a user message.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: next.slice(1) }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? data.error ?? "Error inesperado" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "No me pude conectar. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="turno flex h-[28rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
            m.role === "user" ? "ml-auto bg-ink text-paper" : "bg-ink/[0.06]"}`}>
            {m.content}
          </p>
        ))}
        {loading && <p className="text-sm text-ink/50">Escribiendo…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-[var(--line)] p-3">
        <label htmlFor="chat-input" className="sr-only">Mensaje</label>
        <input id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000}
          placeholder="Escribe tu mensaje…" className="turno-in flex-1" />
        <button disabled={loading} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50">
          Enviar
        </button>
      </form>
    </div>
  );
}
