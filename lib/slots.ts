// Pure calculation of available times (no DB) so it can be tested.

export type Availability = { staff_id: number; weekday: number; start_time: string; end_time: string };
export type Busy = { staff_id: number; starts_at: string; ends_at: string };
export type Slot = { staff_id: number; starts_at: string };

const STEP_MIN = 30;

// Offset (ms) of a time zone at a given instant.
function tzOffset(ts: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(ts).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

// "2026-10-17" + "10:30" in the business's zone -> UTC timestamp.
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const first = wall - tzOffset(wall, timeZone);
  return wall - tzOffset(first, timeZone); // segunda pasada corrige cambios de horario
}

export function computeSlots(opts: {
  date: string; // YYYY-MM-DD in the business's zone
  timeZone: string;
  durationMin: number;
  availability: Availability[];
  busy: Busy[];
  now?: number;
}): Slot[] {
  const { date, timeZone, durationMin, availability, busy, now = Date.now() } = opts;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dur = durationMin * 60_000;
  const slots: Slot[] = [];

  for (const a of availability.filter((a) => a.weekday === weekday)) {
    const end = zonedToUtc(date, a.end_time, timeZone);
    const taken = busy
      .filter((b) => b.staff_id === a.staff_id)
      .map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)]);

    for (let t = zonedToUtc(date, a.start_time, timeZone); t + dur <= end; t += STEP_MIN * 60_000) {
      if (t <= now) continue;
      if (taken.some(([s, e]) => t < e && t + dur > s)) continue;
      slots.push({ staff_id: a.staff_id, starts_at: new Date(t).toISOString() });
    }
  }
  return slots.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
}
