"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getBusiness } from "@/lib/booking";
import { isAdmin } from "@/lib/auth";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Each action: checks admin, resolves the business and limits changes to its rows.
async function guard(slug: string) {
  if (!(await isAdmin())) redirect("/login");
  const b = await getBusiness(slug);
  if (!b) redirect("/dashboard");
  return b;
}

function back(slug: string, error?: string): never {
  revalidatePath(`/dashboard/${slug}`);
  redirect(`/dashboard/${slug}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function serviceFields(f: FormData) {
  const name = String(f.get("name") ?? "").trim();
  const duration = Number(f.get("duration_min"));
  const price = Number(f.get("price"));
  if (!name || name.length > 100) return { error: "Nombre de servicio inválido" };
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) return { error: "Duración entre 5 y 600 minutos" };
  if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido" };
  return { name, duration, price };
}

const fkError = (e: unknown) => (e as { code?: string }).code === "23503";

export async function saveService(slug: string, f: FormData) {
  const b = await guard(slug);
  const v = serviceFields(f);
  if ("error" in v) back(slug, v.error);
  const id = Number(f.get("id"));
  if (id) {
    await sql`update services set name = ${v.name}, duration_min = ${v.duration}, price = ${v.price}
              where id = ${id} and business_id = ${b.id}`;
  } else {
    await sql`insert into services (business_id, name, duration_min, price) values (${b.id}, ${v.name}, ${v.duration}, ${v.price})`;
  }
  back(slug);
}

export async function deleteService(slug: string, f: FormData) {
  const b = await guard(slug);
  try {
    await sql`delete from services where id = ${Number(f.get("id"))} and business_id = ${b.id}`;
  } catch (e) {
    if (fkError(e)) back(slug, "No se puede borrar: el servicio tiene citas registradas");
    throw e;
  }
  back(slug);
}

export async function saveStaff(slug: string, f: FormData) {
  const b = await guard(slug);
  const name = String(f.get("name") ?? "").trim();
  if (!name || name.length > 100) back(slug, "Nombre inválido");
  const id = Number(f.get("id"));
  if (id) await sql`update staff set name = ${name} where id = ${id} and business_id = ${b.id}`;
  else await sql`insert into staff (business_id, name) values (${b.id}, ${name})`;
  back(slug);
}

export async function deleteStaff(slug: string, f: FormData) {
  const b = await guard(slug);
  try {
    await sql`delete from staff where id = ${Number(f.get("id"))} and business_id = ${b.id}`;
  } catch (e) {
    if (fkError(e)) back(slug, "No se puede borrar: tiene citas registradas");
    throw e;
  }
  back(slug);
}

// Replaces a person's entire weekly schedule. A day with no hours = does not work.
export async function saveSchedule(slug: string, f: FormData) {
  const b = await guard(slug);
  const staffId = Number(f.get("staff_id"));
  const rows: { staff_id: number; weekday: number; start_time: string; end_time: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const start = String(f.get(`start_${d}`) ?? "");
    const end = String(f.get(`end_${d}`) ?? "");
    if (!start && !end) continue;
    if (!TIME.test(start) || !TIME.test(end) || end <= start) back(slug, "Cada día necesita hora de inicio menor a la de fin");
    rows.push({ staff_id: staffId, weekday: d, start_time: start, end_time: end });
  }

  await sql.begin(async (tx) => {
    const [owned] = await tx`select 1 from staff where id = ${staffId} and business_id = ${b.id}`;
    if (!owned) return;
    await tx`delete from availability where staff_id = ${staffId}`;
    if (rows.length) await tx`insert into availability ${tx(rows)}`;
  });
  back(slug);
}
