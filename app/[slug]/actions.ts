"use server";
import { createAppointment, getAvailableSlots, getBusiness, type BookingInput } from "@/lib/booking";

async function business(slug: string) {
  const b = await getBusiness(slug);
  if (!b) throw new Error("Negocio no encontrado");
  return b;
}

export async function fetchSlots(slug: string, serviceId: number, date: string, staffId?: number) {
  return getAvailableSlots(await business(slug), serviceId, date, staffId);
}

// Days of the month with at least one free hour (YYYY-MM-DD). month: 1-12.
// one query per day in parallel; if the month feels slow, compute it in a single query.
export async function fetchMonth(slug: string, serviceId: number, year: number, month: number, staffId?: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Mes inválido");
  const b = await business(slug);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  const dates = Array.from({ length: days }, (_, i) => `${year}-${p(month)}-${p(i + 1)}`);
  const found = await Promise.all(
    dates.map(async (d) => ((await getAvailableSlots(b, serviceId, d, staffId)).length ? d : null)),
  );
  return found.filter((d): d is string => d !== null);
}

export async function book(slug: string, input: BookingInput) {
  return createAppointment(await business(slug), input);
}
