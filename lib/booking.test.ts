import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Next does not load .env.local with NODE_ENV=test; we load it directly.
try { process.loadEnvFile(".env.local"); } catch {}

vi.mock("server-only", () => ({}));

// Needs Postgres with the schema applied: DATABASE_URL in .env.local + npm run db:setup.
// The describe body runs even when skipped; the connection goes in beforeAll.
describe.skipIf(!process.env.DATABASE_URL)("reservas en Postgres", () => {
  const CONTACT = "vitest@example.com";
  let m: typeof import("./booking"), sql: typeof import("./db").sql;
  let b: import("./booking").Business, service: import("./booking").Service, person: import("./booking").Staff;

  beforeAll(async () => {
    m = await import("./booking");
    sql = (await import("./db")).sql;
    b = (await m.getBusiness("demo"))!;
    const { services, staff } = await m.getCatalog(b.id);
    [service, person] = [services[0], staff[0]];
  });
  // The next Monday with free hours for that person.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const monday = d.toISOString().slice(0, 10);
  const input = (startsAt: string, name = "Ana") =>
    ({ serviceId: service.id, staffId: person.id, startsAt, customerName: name, customerContact: CONTACT });

  afterAll(async () => {
    await sql`delete from appointments where customer_contact = ${CONTACT}`;
    await sql.end();
  });

  test("reserva un slot y rechaza la doble reserva", async () => {
    const [slot] = await m.getAvailableSlots(b, service.id, monday, person.id);
    expect((await m.createAppointment(b, input(slot.starts_at))).ok).toBe(true);
    expect(await m.createAppointment(b, input(slot.starts_at))).toEqual({ ok: false, error: "Ese horario ya no está disponible" });
    expect((await m.getAvailableSlots(b, service.id, monday, person.id)).some((s) => s.starts_at === slot.starts_at)).toBe(false);
  });

  test("dos reservas simultáneas al mismo horario: solo una gana (EXCLUDE)", async () => {
    const [slot] = await m.getAvailableSlots(b, service.id, monday, person.id);
    const results = await Promise.all([m.createAppointment(b, input(slot.starts_at, "A")), m.createAppointment(b, input(slot.starts_at, "B"))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  test("rechaza horarios fuera de agenda y datos faltantes", async () => {
    expect((await m.createAppointment(b, input(`${monday}T09:00:00Z`))).ok).toBe(false); // 3am local
    const [slot] = await m.getAvailableSlots(b, service.id, monday, person.id);
    expect((await m.createAppointment(b, input(slot.starts_at, " "))).ok).toBe(false);
  });
});
