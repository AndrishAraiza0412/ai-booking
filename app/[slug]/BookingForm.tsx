"use client";
import { useEffect, useRef, useState } from "react";
import type { Service, Staff } from "@/lib/booking";
import { book, fetchMonth, fetchSlots } from "./actions";

type Slot = { staff_id: number; starts_at: string };
type Done = { startsAt: string; endsAt: string; service: string };

const WEEK = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

export default function BookingForm({ slug, services, staff, timeZone }: {
  slug: string; services: Service[]; staff: Staff[]; timeZone: string;
}) {
  const [today] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()));
  const [ym, setYm] = useState(today.slice(0, 7)); // "2026-11"
  const [serviceId, setServiceId] = useState(services[0]?.id);
  const [staffId, setStaffId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [free, setFree] = useState<Set<string> | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [err, setErr] = useState("");
  const [bad, setBad] = useState<"name" | "contact" | "">("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [nonce, setNonce] = useState(0); // fuerza recargar horarios
  // Silent refresh: today's hours keep passing while the page stays open.
  const [tick, setTick] = useState(0);
  const monthKey = useRef("");
  const slotKey = useRef("");
  const chosenRef = useRef("");
  chosenRef.current = chosen;
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  const y = +ym.slice(0, 4);
  const m = +ym.slice(5);
  const service = services.find((s) => s.id === serviceId);

  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat("es", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const longDate = (d: string) =>
    new Intl.DateTimeFormat("es", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00Z`));
  const monthTitle = new Intl.DateTimeFormat("es", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T12:00:00Z`));

  useEffect(() => {
    const bump = () => { if (document.visibilityState === "visible") setTick((t) => t + 1); };
    const id = setInterval(bump, 60_000);
    document.addEventListener("visibilitychange", bump);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", bump); };
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    let stale = false;
    const key = `${serviceId}|${staffId}|${ym}|${nonce}`;
    if (monthKey.current !== key) { monthKey.current = key; setFree(null); } // same month: it updates without flicker
    fetchMonth(slug, serviceId, y, m, staffId || undefined)
      .then((d) => {
        if (stale) return;
        setFree(new Set(d));
        // As in the reel: when the month loads a day is already selected and its hours are in view.
        setDate((cur) => (d.includes(cur) ? cur : d[0] ?? ""));
      })
      .catch(() => !stale && setErr("No se pudo cargar el calendario. Recarga la página."));
    return () => { stale = true; };
  }, [slug, serviceId, staffId, y, m, ym, nonce, tick]);

  useEffect(() => {
    if (!date || !serviceId) return;
    let stale = false;
    const key = `${serviceId}|${staffId}|${date}|${nonce}`;
    if (slotKey.current !== key) { slotKey.current = key; setSlots(null); }
    fetchSlots(slug, serviceId, date, staffId || undefined)
      .then((s) => {
        if (stale) return;
        setSlots(s);
        if (chosenRef.current && !s.some((x) => x.starts_at === chosenRef.current)) {
          setChosen("");
          setErr("Esa hora ya no está disponible. Elige otra.");
        }
      })
      .catch(() => { if (!stale) { setSlots([]); setErr("No se pudieron cargar las horas. Intenta de nuevo."); } });
    return () => { stale = true; };
  }, [slug, serviceId, staffId, date, nonce, tick]);

  function restart() {
    setDate(""); setSlots(null); setChosen(""); setErr("");
  }

  function moveMonth(delta: number) {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  // Same time with several people: a single row is shown (the first free person).
  const rows = slots && slots.filter((s, i) => slots.findIndex((x) => x.starts_at === s.starts_at) === i);

  async function confirm() {
    const s = rows?.find((r) => r.starts_at === chosen);
    if (!s || !serviceId) return;
    if (!name.trim() || !contact.trim()) {
      const field = name.trim() ? "contact" : "name";
      setBad(field);
      setErr("Escribe tu nombre y un contacto para confirmar.");
      (field === "name" ? nameRef : contactRef).current?.focus();
      return;
    }
    setPending(true); setErr(""); setBad("");
    try {
      const r = await book(slug, {
        serviceId, staffId: s.staff_id, startsAt: s.starts_at,
        customerName: name.trim(), customerContact: contact.trim(),
      });
      if (r.ok) setDone({ startsAt: r.startsAt, endsAt: r.endsAt, service: r.service });
      else { setErr(r.error); setChosen(""); setNonce((n) => n + 1); }
    } catch {
      setErr("No se pudo reservar. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  function again() {
    setDone(null); restart(); setNonce((n) => n + 1);
  }

  if (done) {
    const f = (iso: string) => iso.replace(/[-:]|\.\d{3}/g, "");
    const ics = "data:text/calendar;charset=utf-8," + encodeURIComponent(
      ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${done.service}`,
        `DTSTART:${f(done.startsAt)}`, `DTEND:${f(done.endsAt)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n"),
    );
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(done.startsAt));
    return (
      <div className="turno">
        <div className="turno-ok flex min-h-[26rem] flex-col items-center justify-center gap-3 px-6 text-center" role="status">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="32" cy="32" r="30" pathLength={1} /><path d="M20 33l8 8 16-17" pathLength={1} />
          </svg>
          <h3 className="mt-2 text-xl font-semibold">Reservado</h3>
          <p className="text-sm">{longDate(localDate)} · {hhmm(done.startsAt)} – {hhmm(done.endsAt)}</p>
          <p className="text-xs text-[var(--muted)]">{done.service} · {name.trim()}</p>
          <div className="mt-3 flex gap-2">
            <a href={ics} download="cita.ics" className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs transition hover:bg-ink/5">
              Agregar al calendario
            </a>
            <button onClick={again} className="rounded-lg bg-ink px-3 py-2 text-xs font-medium text-paper transition hover:bg-ink/85">
              Agendar otra
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calendar: Monday first. The disc is positioned in % of its own cell, so nothing has to be measured.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sel = date.startsWith(ym) ? offset + +date.slice(8) - 1 : -1;
  const atCurrentMonth = ym <= today.slice(0, 7);

  return (
    <div className="turno grid md:grid-cols-[16rem_1fr_14rem]">
      {/* Servicio y datos */}
      <section className="flex flex-col gap-5 border-b border-[var(--line)] p-5 md:border-b-0 md:border-r">
        <div>
          <h3 className="text-lg font-semibold leading-tight">{service?.name}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {service?.duration_min} min{service && service.price > 0 ? ` · $${service.price}` : ""} · hora de {timeZone.split("/").pop()?.replace("_", " ")}
          </p>
        </div>
        <div className="space-y-1" role="group" aria-label="Tipo de reserva">
          {services.map((s) => (
            <button key={s.id} className="turno-opt" aria-pressed={s.id === serviceId}
              onClick={() => { setServiceId(s.id); restart(); }}>
              <span>{s.name}</span><span className="text-[0.7rem] opacity-70">{s.duration_min} min</span>
            </button>
          ))}
        </div>
        <div className="space-y-1" role="group" aria-label="Mesa">
          <button className="turno-opt" aria-pressed={staffId === ""} onClick={() => { setStaffId(""); restart(); }}>Cualquiera</button>
          {staff.map((s) => (
            <button key={s.id} className="turno-opt" aria-pressed={staffId === s.id} onClick={() => { setStaffId(s.id); restart(); }}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-2 border-t border-[var(--line)] pt-4">
          <input ref={nameRef} className="turno-in" placeholder="Tu nombre" aria-label="Tu nombre" maxLength={100}
            aria-invalid={bad === "name"} value={name} onChange={(e) => { setName(e.target.value); setBad(""); }} />
          <input ref={contactRef} className="turno-in" placeholder="Email o teléfono" aria-label="Email o teléfono" maxLength={100}
            aria-invalid={bad === "contact"} value={contact} onChange={(e) => { setContact(e.target.value); setBad(""); }}
            onKeyDown={(e) => e.key === "Enter" && chosen && confirm()} />
        </div>
      </section>

      {/* Calendario */}
      <section className="border-b border-[var(--line)] p-5 md:border-b-0 md:border-r">
        <h3 className="text-sm font-medium">Elige día y hora</h3>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-[var(--muted)] first-letter:uppercase" aria-live="polite">{monthTitle}</p>
          <div className="flex gap-1">
            <button aria-label="Mes anterior" disabled={atCurrentMonth} onClick={() => moveMonth(-1)}
              className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] text-xs transition hover:bg-ink/5 disabled:opacity-30">‹</button>
            <button aria-label="Mes siguiente" onClick={() => moveMonth(1)}
              className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] text-xs transition hover:bg-ink/5">›</button>
          </div>
        </div>
        <div className="mx-auto max-w-[22rem]">
        <div className="mt-4 grid grid-cols-7 text-center text-[0.65rem] text-[var(--muted)]" aria-hidden>
          {WEEK.map((w) => <span key={w} className="pb-2">{w}</span>)}
        </div>
        <div className="turno-cal" data-loading={free === null}>
          {sel >= 0 && <span className="turno-disc" aria-hidden style={{ transform: `translate(${(sel % 7) * 100}%, ${Math.floor(sel / 7) * 100}%)` }} />}
          {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = `${ym}-${String(i + 1).padStart(2, "0")}`;
            const isFree = !!free?.has(d);
            return (
              <button key={d} data-free={isFree} data-today={d === today} disabled={!isFree} className="turno-dia"
                aria-pressed={d === date} aria-label={longDate(d)}
                onClick={() => { setDate(d); setChosen(""); setErr(""); }}>
                {i + 1}{isFree && <i aria-hidden />}
              </button>
            );
          })}
        </div>
        </div>
      </section>

      {/* Horas */}
      <section className="p-5">
        {!date ? (
          <p className="text-xs text-[var(--muted)]">Elige un día con puntito para ver las horas libres.</p>
        ) : (
          <>
            <h3 className="text-sm font-medium first-letter:uppercase">{longDate(date)}</h3>
            <p className="mt-1 text-[0.7rem] text-[var(--muted)]">
              {rows ? `${rows.length} ${rows.length === 1 ? "hora libre" : "horas libres"} · ${service?.duration_min} min` : "Buscando horas…"}
            </p>
            <ul key={date + (rows ? "r" : "l")} className="mt-4 space-y-2">
              {rows?.map((s, i) => (
                <li key={s.starts_at} className="turno-fila" data-on={chosen === s.starts_at} style={{ "--i": i } as React.CSSProperties}>
                  <button className="turno-hora" aria-pressed={chosen === s.starts_at}
                    onClick={() => { setChosen(s.starts_at); setErr(""); }}>{hhmm(s.starts_at)}</button>
                  <button className="turno-confirmar" tabIndex={chosen === s.starts_at ? 0 : -1} disabled={pending} onClick={confirm}>
                    {pending ? "…" : "Confirmar"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {err && <p className="mt-3 text-xs text-[#ff8a8a]" role="alert">{err}</p>}
      </section>
    </div>
  );
}
