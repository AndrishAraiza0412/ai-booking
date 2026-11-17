import "server-only";
import { sql } from "./db";
import { computeSlots, type Availability } from "./slots";

export type Business = { id: number; slug: string; name: string; timezone: string };
export type Service = { id: number; name: string; duration_min: number; price: number };
export type Staff = { id: number; name: string };

export async function getBusiness(slug: string) {
  const [b] = await sql<Business[]>`select * from businesses where slug = ${slug}`;
  return b;
}

export async function listBusinesses() {
  return sql<Business[]>`select * from businesses order by name`;
}

// Spread a arrays normales: se pasan a Client Components.
export async function getCatalog(businessId: number) {
  const [services, staff] = await Promise.all([
    sql<Service[]>`select id, name, duration_min, price::float8 as price from services where business_id = ${businessId} order by id`,
    sql<Staff[]>`select id, name from staff where business_id = ${businessId} order by id`,
  ]);
  return { services: [...services], staff: [...staff] };
}

async function getService(businessId: number, serviceId: number) {
  const [s] = await sql<Service[]>`select * from services where id = ${serviceId} and business_id = ${businessId}`;
  return s;
}

export async function getAvailableSlots(business: Business, serviceId: number, date: string, staffId?: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida, usa YYYY-MM-DD");
  const service = await getService(business.id, serviceId);
  if (!service) throw new Error("Servicio no encontrado");
  const staff = staffId ?? null;

  const availability = await sql<Availability[]>`
    select a.staff_id, a.weekday, to_char(a.start_time, 'HH24:MI') as start_time, to_char(a.end_time, 'HH24:MI') as end_time
    from availability a join staff s on s.id = a.staff_id
    where s.business_id = ${business.id} and (${staff}::int is null or s.id = ${staff}::int)`;

  // A margin of ±1 day covers any time zone offset.
  const busy = await sql<{ staff_id: number; starts_at: Date; ends_at: Date }[]>`
    select staff_id, starts_at, ends_at from appointments
    where business_id = ${business.id} and status = 'confirmed'
      and tstzrange(starts_at, ends_at) && tstzrange(${date}::date - 1, ${date}::date + 2)`;

  return computeSlots({
    date, timeZone: business.timezone, durationMin: service.duration_min, availability,
    busy: busy.map((b) => ({ staff_id: b.staff_id, starts_at: b.starts_at.toISOString(), ends_at: b.ends_at.toISOString() })),
  });
}

export type BookingInput = {
  serviceId: number; staffId: number; startsAt: string; customerName: string; customerContact: string;
};

export async function createAppointment(business: Business, input: BookingInput) {
  const fail = (error: string) => ({ ok: false as const, error });
  const name = input.customerName?.trim();
  const contact = input.customerContact?.trim();
  if (!name || !contact) return fail("Faltan nombre y contacto del cliente");
  if (name.length > 100 || contact.length > 100) return fail("Nombre o contacto demasiado largo");

  const service = await getService(business.id, input.serviceId);
  if (!service) return fail("Servicio no encontrado");
  const start = new Date(input.startsAt);
  if (isNaN(+start)) return fail("Fecha/hora inválida");
  const startsAt = start.toISOString();
  const endsAt = new Date(+start + service.duration_min * 60_000).toISOString();

  // It must be an offered time (within the schedule, in the future). Races are stopped by the DB's EXCLUDE constraint.
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(start);
  const slots = await getAvailableSlots(business, service.id, localDate, input.staffId);
  if (!slots.some((s) => s.starts_at === startsAt)) return fail("Ese horario ya no está disponible");

  try {
    const [r] = await sql<{ id: number }[]>`
      insert into appointments (business_id, service_id, staff_id, customer_name, customer_contact, starts_at, ends_at)
      values (${business.id}, ${service.id}, ${input.staffId}, ${name}, ${contact}, ${startsAt}, ${endsAt})
      returning id`;
    return { ok: true as const, id: r.id, startsAt, endsAt, service: service.name };
  } catch (e) {
    if ((e as { code?: string }).code === "23P01") return fail("Ese horario ya no está disponible");
    throw e;
  }
}

export async function listAppointments(businessId: number) {
  return sql<{
    id: number; starts_at: Date; customer_name: string; customer_contact: string; status: string; service: string; staff: string;
  }[]>`
    select a.id, a.starts_at, a.customer_name, a.customer_contact, a.status, sv.name as service, st.name as staff
    from appointments a join services sv on sv.id = a.service_id join staff st on st.id = a.staff_id
    where a.business_id = ${businessId} and a.ends_at > now() order by a.starts_at`;
}

export async function cancelAppointment(id: number) {
  await sql`update appointments set status = 'cancelled' where id = ${id}`;
}
