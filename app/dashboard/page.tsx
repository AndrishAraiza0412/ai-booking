// Admin dashboard: upcoming appointments for every business, with cancel and sign-out server actions.
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cancelAppointment, listAppointments, listBusinesses } from "@/lib/booking";
import { isAdmin, logout } from "@/lib/auth";
import ConfirmCancel from "./ConfirmCancel";

export const dynamic = "force-dynamic";

async function cancel(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/login");
  await cancelAppointment(Number(formData.get("id")));
  revalidatePath("/dashboard");
}

async function signOut() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function Dashboard() {
  if (!(await isAdmin())) redirect("/login");
  const businesses = await Promise.all(
    (await listBusinesses()).map(async (b) => ({ ...b, appts: await listAppointments(b.id) })),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="flex items-center justify-between gap-4 pr-11 lg:pr-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Próximas reservas</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Lo que viene en tus negocios.</p>
        </div>
        <form action={signOut}><button className="btn btn-ghost">Salir</button></form>
      </header>

      {businesses.map((b) => {
        const day = new Intl.DateTimeFormat("es-MX", { timeZone: b.timezone, weekday: "short", day: "numeric", month: "short" });
        const hour = new Intl.DateTimeFormat("es-MX", { timeZone: b.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
        const confirmed = b.appts.filter((a) => a.status === "confirmed").length;
        return (
          <section key={b.id} className="panel mt-8 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{b.name}</h2>
                <span className="badge badge-ok">{confirmed} {confirmed === 1 ? "reserva" : "reservas"}</span>
              </div>
              <div className="flex gap-2">
                <a href={`/${b.slug}`} className="btn btn-ghost btn-sm">Ver página ↗</a>
                <Link href={`/dashboard/${b.slug}`} className="btn btn-sm">Servicios y horarios</Link>
              </div>
            </div>
            {b.appts.length === 0 ? (
              <p className="border-t border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">Sin reservas próximas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr><th>Fecha</th><th>Reserva</th><th>Mesa</th><th>Cliente</th><th /></tr>
                  </thead>
                  <tbody>
                    {b.appts.map((a) => {
                      const off = a.status !== "confirmed";
                      return (
                        <tr key={a.id} className={off ? "opacity-50" : ""}>
                          <td className="whitespace-nowrap">
                            <span className={`font-medium capitalize ${off ? "line-through" : ""}`}>{day.format(a.starts_at)}</span>
                            <span className="block text-xs text-[var(--muted)]">{hour.format(a.starts_at)}</span>
                          </td>
                          <td>{a.service}</td>
                          <td>{a.staff}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="avatar" aria-hidden>{a.customer_name.trim().charAt(0).toUpperCase()}</span>
                              <span>{a.customer_name}<span className="block text-xs text-[var(--muted)]">{a.customer_contact}</span></span>
                            </div>
                          </td>
                          <td className="text-right">
                            {off ? <span className="badge">Cancelada</span> : (
                              <ConfirmCancel action={cancel} id={a.id}
                                summary={`${a.customer_name} · ${a.service} · ${day.format(a.starts_at)}, ${hour.format(a.starts_at)}`} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
