// Admin settings for one business: services, staff and weekly schedules (changes go through the server actions in ./actions.ts).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getBusiness, getCatalog } from "@/lib/booking";
import { isAdmin } from "@/lib/auth";
import { deleteService, deleteStaff, saveSchedule, saveService, saveStaff } from "./actions";

export const dynamic = "force-dynamic";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function Settings({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }>;
}) {
  if (!(await isAdmin())) redirect("/login");
  const { slug } = await params;
  const { error } = await searchParams;
  const business = await getBusiness(slug);
  if (!business) notFound();
  const { services, staff } = await getCatalog(business.id);
  const hours = await sql<{ staff_id: number; weekday: number; start_time: string; end_time: string }[]>`
    select a.staff_id, a.weekday, to_char(a.start_time, 'HH24:MI') as start_time, to_char(a.end_time, 'HH24:MI') as end_time
    from availability a join staff s on s.id = a.staff_id where s.business_id = ${business.id}`;

  const a = { service: saveService.bind(null, slug), delService: deleteService.bind(null, slug),
    staff: saveStaff.bind(null, slug), delStaff: deleteStaff.bind(null, slug), schedule: saveSchedule.bind(null, slug) };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="pr-11 lg:pr-0">
        <Link href="/dashboard" className="btn btn-ghost btn-sm">← Citas</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {business.name}
          <span className="block text-[var(--muted)]">Servicios y horarios</span>
        </h1>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-[#e5484d]/30 bg-[#e5484d]/10 px-3 py-2 text-sm text-[#e5484d]">{error}</p>}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Servicios</h2>
        <div className="panel divide-y divide-[var(--line)]">
          {[...services, { id: 0, name: "", duration_min: 30, price: 0 }].map((s) => (
            <form key={s.id} action={a.service} className="flex flex-wrap items-end gap-3 p-4">
              <input type="hidden" name="id" value={s.id} />
              <label className="label">Nombre
                <input name="name" defaultValue={s.name} required maxLength={100} placeholder="Nuevo servicio" className="field w-52" /></label>
              <label className="label">Minutos
                <input name="duration_min" type="number" min={5} max={600} step={5} defaultValue={s.duration_min} required className="field w-20" /></label>
              <label className="label">Precio
                <input name="price" type="number" min={0} step="0.01" defaultValue={s.price} required className="field w-24" /></label>
              <button className={s.id ? "btn" : "btn btn-ghost"}>{s.id ? "Guardar" : "+ Agregar"}</button>
              {s.id > 0 && <button formAction={a.delService} formNoValidate className="btn btn-danger">Eliminar</button>}
            </form>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Personal y horarios</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">Deja un día vacío si esa persona no trabaja. Horas en {business.timezone}.</p>
        <div className="space-y-4">
          {staff.map((p) => (
            <div key={p.id} className="panel p-4">
              <form action={a.staff} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={p.id} />
                <label className="label">Nombre
                  <input name="name" defaultValue={p.name} required maxLength={100} className="field w-52" /></label>
                <button className="btn btn-ghost">Renombrar</button>
                <button formAction={a.delStaff} formNoValidate className="btn btn-danger">Eliminar</button>
              </form>
              <form action={a.schedule} className="mt-5 border-t border-[var(--line)] pt-5">
                <input type="hidden" name="staff_id" value={p.id} />
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {DAYS.map((day, d) => {
                    const h = hours.find((x) => x.staff_id === p.id && x.weekday === d);
                    return (
                      <div key={d} className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-[var(--muted)]">{day}</span>
                        <input type="time" name={`start_${d}`} defaultValue={h?.start_time} aria-label={`${day} inicio`} className="field" />
                        <span className="text-[var(--muted)]">–</span>
                        <input type="time" name={`end_${d}`} defaultValue={h?.end_time} aria-label={`${day} fin`} className="field" />
                      </div>
                    );
                  })}
                </div>
                <button className="btn mt-4">Guardar horario</button>
              </form>
            </div>
          ))}
          <form action={a.staff} className="panel flex flex-wrap items-end gap-3 p-4">
            <label className="label">Agregar persona
              <input name="name" required maxLength={100} placeholder="Nombre" className="field w-52" /></label>
            <button className="btn btn-ghost">+ Agregar</button>
          </form>
        </div>
      </section>
    </main>
  );
}
