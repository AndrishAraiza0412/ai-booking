// Admin sign-in: a single password (ADMIN_PASSWORD) that starts the admin session.
import { redirect } from "next/navigation";
import { checkPassword, login } from "@/lib/auth";

async function signIn(formData: FormData) {
  "use server";
  if (!checkPassword(String(formData.get("password") ?? ""))) redirect("/login?error=1");
  await login();
  redirect("/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <div className="panel p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Acceso del negocio</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Entra para ver y gestionar tus citas.</p>
        <form action={signIn} className="mt-6 space-y-4">
          <label className="label">Contraseña
            <input type="password" name="password" required autoFocus className="field w-full" aria-invalid={!!error} />
          </label>
          {error && <p className="text-xs text-[#e5484d]" role="alert">Contraseña incorrecta</p>}
          <button className="btn w-full py-2.5">Entrar</button>
        </form>
      </div>
    </main>
  );
}
