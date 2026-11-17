import { expect, test } from "vitest";
import { computeSlots, zonedToUtc } from "./slots";

const TZ = "America/Mexico_City"; // UTC-6, sin horario de verano
const avail = [{ staff_id: 1, weekday: 1, start_time: "10:00", end_time: "12:00" }];
const base = { date: "2026-10-19", timeZone: TZ, availability: avail, now: 0 }; // lunes

test("zonedToUtc convierte hora local a UTC", () => {
  expect(new Date(zonedToUtc("2026-10-19", "10:00", TZ)).toISOString()).toBe("2026-10-19T16:00:00.000Z");
});

test("genera slots que caben antes del cierre", () => {
  const s = computeSlots({ ...base, durationMin: 60, busy: [] });
  expect(s.map((x) => x.starts_at)).toEqual([
    "2026-10-19T16:00:00.000Z", "2026-10-19T16:30:00.000Z", "2026-10-19T17:00:00.000Z",
  ]);
});

test("excluye slots que se solapan con citas", () => {
  const busy = [{ staff_id: 1, starts_at: "2026-10-19T16:30:00Z", ends_at: "2026-10-19T17:00:00Z" }];
  const s = computeSlots({ ...base, durationMin: 30, busy });
  expect(s.map((x) => x.starts_at)).toEqual([
    "2026-10-19T16:00:00.000Z", "2026-10-19T17:00:00.000Z", "2026-10-19T17:30:00.000Z",
  ]);
});

test("citas de otro staff no bloquean", () => {
  const busy = [{ staff_id: 2, starts_at: "2026-10-19T16:00:00Z", ends_at: "2026-10-19T18:00:00Z" }];
  expect(computeSlots({ ...base, durationMin: 30, busy })).toHaveLength(4);
});

test("día sin horario y horas pasadas no devuelven slots", () => {
  expect(computeSlots({ ...base, date: "2026-10-18", durationMin: 30, busy: [] })).toEqual([]);
  const now = Date.parse("2026-10-19T17:00:00Z");
  expect(computeSlots({ ...base, durationMin: 30, busy: [], now })).toHaveLength(1);
});

test("mismo día: solo quedan las horas posteriores a la hora actual", () => {
  // Restaurant: 13:00-23:00, 90-minute table. It is 15:10 in Mexico City (21:10Z).
  const avail = [{ staff_id: 1, weekday: 1, start_time: "13:00", end_time: "23:00" }];
  const now = Date.parse("2026-10-19T21:10:00Z");
  const s = computeSlots({ date: "2026-10-19", timeZone: TZ, durationMin: 90, availability: avail, busy: [], now });
  expect(s[0].starts_at).toBe("2026-10-19T21:30:00.000Z"); // 15:30, la primera media hora futura
  expect(s.at(-1)!.starts_at).toBe("2026-10-20T03:30:00.000Z"); // 21:30, the last one that ends at 23:00
  // After closing time there is nothing left today.
  const late = Date.parse("2026-10-20T04:00:00Z"); // 22:00
  expect(computeSlots({ date: "2026-10-19", timeZone: TZ, durationMin: 90, availability: avail, busy: [], now: late })).toEqual([]);
});
