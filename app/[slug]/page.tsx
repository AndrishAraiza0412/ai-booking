// Public page of a business: booking form and chat assistant, both backed by the same booking logic (lib/booking.ts).
import { notFound } from "next/navigation";
import { getBusiness, getCatalog } from "@/lib/booking";
import BookingForm from "./BookingForm";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();
  const { services, staff } = await getCatalog(business.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-center text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        {business.name}
        <span className="block text-ink/40">Elige día y hora</span>
      </h1>
      <div className="mt-12">
        <BookingForm slug={slug} services={services} staff={staff} timeZone={business.timezone} />
      </div>
      <section className="mx-auto mt-16 max-w-xl">
        <h2 className="mb-3 text-sm font-medium text-ink/50">O agenda hablando con el asistente</h2>
        <Chat slug={slug} />
      </section>
    </main>
  );
}
