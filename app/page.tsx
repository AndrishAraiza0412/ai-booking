// Landing page: links to the demo business and to the admin dashboard.
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-28 text-center">
      <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Reservas con IA
        <span className="block text-ink/40">Día, hora y listo</span>
      </h1>
      <p className="mt-6 text-ink/60">Agenda citas escribiendo como hablas: «una mesa para 4 el viernes en la noche».</p>
      <div className="mt-10 flex justify-center gap-3">
        <Link href="/demo" className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/85">Probar demo</Link>
        <Link href="/dashboard" className="rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm transition hover:bg-ink/5">Panel del negocio</Link>
      </div>
    </main>
  );
}
