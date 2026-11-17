import { createAppointment, getAvailableSlots, getBusiness, getCatalog, type Business } from "@/lib/booking";
import { zonedToUtc } from "@/lib/slots";

// Groq exposes an OpenAI-compatible API; no SDK is needed.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

const fn = (name: string, description: string, properties: object, required: string[] = []) =>
  ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });

const tools = [
  fn("get_available_slots", "Horarios libres (hora local HH:MM) para un servicio en una fecha, agrupados por mesa.", {
    service_id: { type: "integer" },
    date: { type: "string", description: "YYYY-MM-DD en la zona horaria del negocio" },
    staff_id: { type: "integer", description: "Opcional: solo esa mesa" },
  }, ["service_id", "date"]),
  fn("book_appointment", "Reserva una mesa. Úsalo SOLO después de que el cliente confirme servicio, horario, nombre y contacto.", {
    service_id: { type: "integer" },
    staff_id: { type: "integer" },
    date: { type: "string", description: "YYYY-MM-DD" },
    time: { type: "string", description: "HH:MM local, tal como lo devolvió get_available_slots" },
    customer_name: { type: "string" },
    customer_contact: { type: "string", description: "Email o teléfono" },
  }, ["service_id", "staff_id", "date", "time", "customer_name", "customer_contact"]),
];

async function runTool(business: Business, name: string, args: string) {
  try {
    const input = JSON.parse(args || "{}");
    switch (name) {
      case "get_available_slots": {
        const slots = await getAvailableSlots(business, Number(input.service_id), String(input.date),
          input.staff_id ? Number(input.staff_id) : undefined);
        const day = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
          .format(new Date(`${input.date}T12:00:00Z`));
        if (!slots.length) return `Sin horarios libres el ${day}.`;
        // Compact and in local time: fewer tokens (free quota) and the model does not convert UTC.
        const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit" });
        const byStaff: Record<string, string[]> = {};
        for (const s of slots) (byStaff[`staff_id ${s.staff_id}`] ??= []).push(fmt.format(new Date(s.starts_at)));
        return { fecha: day, horarios: byStaff };
      }
      case "book_appointment": {
        const date = String(input.date), time = String(input.time);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "Error: usa date YYYY-MM-DD y time HH:MM";
        return await createAppointment(business, {
          serviceId: Number(input.service_id), staffId: Number(input.staff_id),
          startsAt: new Date(zonedToUtc(date, time, business.timezone)).toISOString(),
          customerName: String(input.customer_name ?? ""), customerContact: String(input.customer_contact ?? ""),
        });
      }
      default:
        return `Herramienta desconocida: ${name}`;
    }
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

async function systemPrompt(b: Business) {
  const { services, staff } = await getCatalog(b.id);
  const now = new Intl.DateTimeFormat("es-MX", { timeZone: b.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date());
  // Calendar already resolved: models fail at counting days ("next Monday").
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: b.timezone });
  const dayName = new Intl.DateTimeFormat("es-MX", { timeZone: b.timezone, weekday: "long", day: "numeric" });
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + i * 86_400_000))
    .map((d) => `${dayName.format(d)} = ${iso.format(d)}`).join(", ");
  return `Eres el asistente de reservas de "${b.name}". Respondes en español, breve y amable.
Ahora es ${now} (zona horaria ${b.timezone}).
Calendario (usa SIEMPRE esta tabla para convertir "mañana", "el lunes", etc. a fecha; no calcules): ${days}.
Tipos de reserva: ${services.map((s) => `[id ${s.id}] ${s.name}, ${s.duration_min} min, $${s.price}`).join("; ")}.
Mesas: ${staff.map((p) => `[staff_id ${p.id}] ${p.name}`).join("; ")}.
Reglas:
- Nunca inventes tipos de reserva, precios ni horarios. Usa get_available_slots antes de proponer horarios.
- Escribe en texto plano, sin tablas ni markdown. Ofrece pocas opciones (3-4), no la lista completa.
- Si no hay lugar, ofrece las alternativas más cercanas reales.
- Antes de book_appointment, resume la reserva y pide confirmación explícita, además de nombre y email/teléfono.
- Tras reservar, confirma tipo de reserva, mesa, día y hora local.
- Si preguntan algo ajeno a las reservas del negocio, redirige amablemente.`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type GroqMessage = { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) return Response.json({ error: "Falta GROQ_API_KEY en .env.local" }, { status: 500 });
  const { slug, messages } = (await req.json()) as { slug: string; messages: ChatMessage[] };
  const business = await getBusiness(String(slug));
  if (!business) return Response.json({ error: "Negocio no encontrado" }, { status: 404 });

  // Basic limits: the endpoint is public and Groq's free quota is limited.
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40
      || messages.some((m) => !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 2000)) {
    return Response.json({ error: "Mensajes inválidos" }, { status: 400 });
  }

  const convo: GroqMessage[] = [
    { role: "system", content: await systemPrompt(business) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const call = () => fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, messages: convo, tools, temperature: 0.2, max_tokens: 1024,
      ...(MODEL.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }), // menos tokens de razonamiento
    }),
  });

  // Tool-use loop: the model asks for tools until it answers the user.
  for (let i = 0; i < 8; i++) {
    let res = await call();
    // Per-minute limit of the free plan: if it frees up soon, wait and retry once.
    const wait = Number(res.headers.get("retry-after"));
    if (res.status === 429 && wait > 0 && wait <= 20) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await call();
    }
    if (res.status === 429) {
      return Response.json({ reply: "Estoy recibiendo muchas solicitudes. Intenta en un minuto o usa el formulario de al lado." });
    }
    if (!res.ok) {
      console.error("Groq", res.status, await res.text());
      return Response.json({ reply: "Tuve un problema procesando eso. ¿Puedes repetirlo con otras palabras?" });
    }
    const msg: GroqMessage = (await res.json()).choices[0].message;
    if (!msg.tool_calls?.length) return Response.json({ reply: msg.content ?? "" });

    convo.push(msg);
    for (const tc of msg.tool_calls) {
      const result = await runTool(business, tc.function.name, tc.function.arguments);
      convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  return Response.json({ reply: "Perdón, no pude completar la solicitud. ¿Puedes intentarlo de nuevo?" });
}
