"use client";
import { useRef, useState } from "react";

// "Cancel" button that asks for confirmation in a modal dialog before running the server action.
export default function ConfirmCancel({ action, id, summary }: {
  action: (formData: FormData) => void | Promise<void>; id: number; summary: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-danger btn-sm" onClick={() => ref.current?.showModal()}>Cancelar</button>
      <dialog ref={ref} className="confirm" aria-labelledby={`c${id}`}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <form action={action} onSubmit={() => setBusy(true)} className="text-left">
          <input type="hidden" name="id" value={id} />
          <h3 id={`c${id}`} className="text-base font-semibold">¿Cancelar esta reserva?</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{summary}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">El horario quedará libre otra vez. No se puede deshacer.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()} disabled={busy}>Volver</button>
            <button className="btn btn-destructive" disabled={busy}>{busy ? "Cancelando…" : "Sí, cancelar"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
